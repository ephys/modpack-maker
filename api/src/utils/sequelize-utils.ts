import assert from 'assert';
import toArray from 'lodash/toArray.js';
import type {
  DestroyOptions,
  ModelCtor as SequelizeModelCtor,
  UpdateOptions,
  Model as SequelizeModel,
  WhereOptions,
  UniqueConstraintError,
} from 'sequelize';
import { col as builtInCol, Utils as SequelizeUtilPkg } from 'sequelize';
import type { ModelCtor as STModelCtor, Model as STModel } from 'sequelize-typescript';
import type { ModelAttributeColumnOptions } from 'sequelize/lib/model';
import type { Col } from 'sequelize/lib/utils';
import { Op, DataTypes } from '../esm-compat/sequelize-esm';

const { mapWhereFieldNames } = SequelizeUtilPkg;

type Model = SequelizeModel | STModel;
type ModelType<T extends SequelizeModel | STModel> = T extends STModel ? STModelCtor<T> : SequelizeModelCtor<T>;

/**
 * Akin to Sequelize.Model.update() but updates one row only.
 * On mariadb/mysql, the affected row count will be limited to 1.
 * On other databases, if more than one row was updated, a fatal error will be thrown to warn the developer
 * that their query is wrong.
 *
 * @param {!Sequelize.Model} model - The sequelize model on which the update will be executed.
 * @param {!Object} values - Param 1 of Sequelize.Model.update
 * @param {!Object} options - Param 2 of Sequelize.Model.update
 * @returns {!Promise.<Sequelize.Instance>} The updated instance or null if none matched.
 */
export async function updateOne<TAttributes extends Model>(
  model: ModelType<TAttributes>,
  values: object,
  options: UpdateOptions,
) {
  const newOptions = Object.assign({}, options);
  newOptions.limit = 1;

  const [affectedCount, affectedRows] = await model.update(values, newOptions);
  if (affectedCount === 0) {
    return null;
  }

  if (affectedCount > 1) {
    throw new Error(
      '#updateOne updated more than one result, please double check your `where` selector.',
    );
  }

  return affectedRows[0];
}

/**
 * Akin to Sequelize.Model.destroy() but deletes one row only.
 * On mariadb/mysql, the affected row count will be limited to 1.
 * On other databases, if more than one row was deleted, a fatal error will be thrown to warn the developer
 * that their query is wrong.
 *
 * @param {!Sequelize.Model} model - The sequelize model on which the delete will be executed.
 * @param {!Object} options - Param 2 of Sequelize.Model.delete
 * @returns {!Promise.<!boolean>} True: a row was deleted, false: no row was deleted.
 */
export async function destroyOne(model: ModelType<any>, options?: DestroyOptions): Promise<boolean> {
  assert(model.sequelize != null, 'Model is not registered');

  const callback = async transaction => {
    const newOptions = { transaction, ...options };
    newOptions.limit = 1;

    const affectedCount = await model.destroy(newOptions);
    if (affectedCount === 0) {
      return false;
    }

    if (affectedCount > 1) {
      throw new Error(
        '#destroyOne deleted more than one result, please double check your `where` selector.',
      );
    }

    return true;
  };

  if (!options?.transaction) {
    throw new Error('destroyOne needs a transaction');
  }

  return callback(options.transaction);
}

export function attributeNameToColumnIfExists(
  model: ModelType<any>,
  attributeName: string,
): string | null {
  const attribute = model.rawAttributes[attributeName];

  return attribute?.field ?? null;
}

export function attributeNameToColumn(
  model: ModelType<any>,
  attributeName: string,
): string {
  const attribute = model.rawAttributes[attributeName];
  if (!attribute) {
    throw new Error(`Model ${model.name} does not have an attribute named ${attributeName}`);
  }

  return attribute.field ?? attributeName;
}

export function columnToAttributeName(
  model: ModelType<any>,
  columnName: string,
): string {
  for (const attribute of Object.keys(model.rawAttributes)) {
    const column = model.rawAttributes[attribute].field ?? attribute;

    if (column === columnName) {
      return attribute;
    }
  }

  throw new Error(`Model ${model.name} does not have a column named ${columnName}`);
}

export function mapResultsToModel<T extends Model>(results: object[], model: ModelType<T>): T[] {
  return results.map(result => mapResultToModel(result, model));
}

export function mapResultToModel<T extends Model>(result: object, model: ModelType<T>): T {
  const initRecord = { ...result };

  // TODO: how to provide that the proper way?
  //   for some reason, including it in initRecord does not work
  const includes = {};

  for (const associationKey of Object.keys(model.associations)) {
    const includedData = result[associationKey];
    if (includedData == null) {
      continue;
    }

    const association = model.associations[associationKey];

    const isMulti = association.isMultiAssociation;
    if (isMulti) {
      includes[associationKey] = mapResultsToModel(toArray(includedData), association.target);
    } else {
      includes[associationKey] = mapResultToModel(includedData, association.target);
    }
  }

  const modelInstance = model.build(initRecord, { isNewRecord: false, raw: true });

  Object.assign(modelInstance, includes);

  return modelInstance as T;
}

export function buildAttributeList<T extends Model>(model: ModelType<T>, alias: string, outputKey?: string): string {
  const attributesMap = model.rawAttributes;
  const columns = Object.keys(attributesMap);

  outputKey = outputKey ?? model.name;
  if (outputKey) {
    outputKey += '.';
  }

  return columns.map(attributeName => `"${alias}"."${attributeNameToColumn(model, attributeName)}" AS "${outputKey}${attributeName}"`).join(', ');
}

export function buildWhereComponent(whereOption: WhereOptions, model: ModelType<any>, tableName: string): string {
  const sequelize = model.sequelize;

  assert(sequelize != null, 'Model has not been initialized');

  const generator = sequelize
    .getQueryInterface()
    .queryGenerator;

  // @ts-expect-error sequelize does not provide typings for QueryGenerator
  return generator.getWhereConditions(
    mapWhereFieldNames(whereOption, model),
    tableName,
    model,
  ).trim();
}

export function where(whereOption: WhereOptions, model: ModelType<any>, tableName: string);
export function where(clause: string): string;
export function where(clauseOrWhere: string | WhereOptions, model?: ModelType<any>, tableName?: string): string {
  if (!clauseOrWhere) {
    return '';
  }

  if (typeof clauseOrWhere === 'string') {
    return `WHERE ${clauseOrWhere}`;
  }

  assert(model != null);
  assert(tableName != null);

  return where(buildWhereComponent(clauseOrWhere, model, tableName));
}

export function andWhere(clause: WhereOptions | null, model: ModelType<any>, tableName: string);
export function andWhere(clause: string);
export function andWhere(clauseOrWhere: string | WhereOptions | null, model?: ModelType<any>, tableName?: string) {
  if (!clauseOrWhere) {
    return '';
  }

  if (typeof clauseOrWhere === 'string') {
    return `AND ${clauseOrWhere}`;
  }

  assert(model != null);
  assert(tableName != null);

  return andWhere(buildWhereComponent(clauseOrWhere, model, tableName));
}

/**
 * @param {string} column The possible association reference string
 * @returns {null | [string, string]} an array of [associationName, associationColumn] if the provided parameter is an association reference,
 * that is a string following the format '$associationName.associationColumn$
 */
export function matchAssociationReference(column: string): null | [string, string] {
  const match = column.match(/^\$([^.]+)\.(.+)\$$/);

  if (!match) {
    return null;
  }

  return [match[1], match[2]];
}

export function buildOrder(orders, tableAlias: string, model?: ModelType<any>) {
  // TODO use QueryGenerator#getQueryOrders if they support $table.column$
  return orders
    .map(order => {
      // tableAlias, col, dir
      if (order.length === 3) {
        const [alias, column, dir] = order;

        const columnName = model ? attributeNameToColumn(model, column) : column;

        return `"${alias}"."${columnName}" ${dir}`;
      }

      const column: string = order[0];
      const dir = order[1];

      // format $table.column$, used for referencing joined tables
      const associationReference = matchAssociationReference(column);
      if (associationReference) {
        return `"${associationReference[0]}"."${associationReference[1]}" ${dir}`;
      }

      const attributeToCol = model ? attributeNameToColumnIfExists(model, column) : column;
      const columnName = attributeToCol ?? column;

      // !TODO: if starts with $, attributeNameToColumnIfExists should throw
      // if attributeName is not part of model, might be a custom column
      if (attributeToCol == null) {
        return `"${columnName}" ${dir}`;
      }

      return `"${tableAlias}"."${columnName}" ${dir}`;
    })
    .join(', ');
}

export function getPrimaryColumns<E extends Model>(model: ModelType<E>): ModelAttributeColumnOptions[] {
  const columns: ModelAttributeColumnOptions[] = [];

  for (const value of Object.values(model.rawAttributes)) {
    if (value.primaryKey) {
      columns.push(value);
    }
  }

  return columns;
}

export function tsEnum(theEnum: Record<string, string>) {
  return DataTypes.ENUM(...Object.values(theEnum));
}

export function getUniqueConstraintKey(error: UniqueConstraintError) {
  // TODO in the future: return as tuple #[]
  return Object.keys(error.fields).sort().join('#');
}

export function notEqual(item) {
  return { [Op.ne]: item };
}

export function and(...opts) {
  return { [Op.and]: opts };
}

export function or(...opts) {
  return { [Op.or]: opts };
}

export function iLike(val) {
  return { [Op.iLike]: val };
}

export function like(val) {
  return { [Op.like]: val };
}

export function equals<T>(val: T): { [Op.eq]: T } {
  return { [Op.eq]: val };
}

export function contains(...val) {
  return { [Op.contains]: val };
}

export function overlap(...val) {
  return { [Op.overlap]: val };
}

export function not(condition) {
  return { [Op.not]: condition };
}

export function isIn(val: readonly any[] | Set<any>) {
  if (!Array.isArray(val)) {
    val = Array.from(val);
  }

  return { [Op.in]: val };
}

export function lesserThanEqual(val: Date | string | number) {
  return { [Op.lte]: val };
}

export function greaterThanEqual(val: Date | string | number) {
  return { [Op.gte]: val };
}

export function greaterThan(val) {
  return { [Op.gt]: val };
}

export function col(entity: ModelType<any>, column: string): Col {
  return builtInCol(attributeNameToColumn(entity, column));
}

export const POSTGRE_SMALLINT_MAX_VALUE = 32767;

export const POSTGRE_INTEGER_MAX_VALUE = 2147483647;
