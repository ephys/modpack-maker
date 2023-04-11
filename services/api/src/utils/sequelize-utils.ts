import assert from 'node:assert';
import { DataTypes, Op } from '@sequelize/core';
import type {
  CreationAttributes,
  DestroyOptions,
  Model,
  ModelStatic,
  UpdateOptions,
  UpdateValues,
  WhereOptions,
} from '@sequelize/core';
import toArray from 'lodash/toArray.js';

/**
 * Akin to Sequelize.Model.update() but updates one row only.
 * On mariadb/mysql, the affected row count will be limited to 1.
 * On other databases, if more than one row was updated, a fatal error will be thrown to warn the developer
 * that their query is wrong.
 *
 * @param model - The sequelize model on which the update will be executed.
 * @param values - Param 1 of Sequelize.Model.update
 * @param options - Param 2 of Sequelize.Model.update
 * @returns The updated instance or null if none matched.
 */
export async function updateOne<M extends Model>(
  model: ModelStatic<M>,
  values: UpdateValues<M>,
  options: UpdateOptions,
) {
  const newOptions = Object.assign({}, options);
  newOptions.limit = 1;

  const [affectedCount, affectedRows] = await model.update(values, {
    ...newOptions,
    returning: true,
  });

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
 * @param model - The sequelize model on which the delete will be executed.
 * @param options - Param 2 of Sequelize.Model.delete
 * @returns true: a row was deleted, false: no row was deleted.
 */
export async function destroyOne(model: ModelStatic<any>, options?: DestroyOptions): Promise<boolean> {
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

export function mapResultsToModel<T extends Model>(results: object[], model: ModelStatic<T>): T[] {
  return results.map(result => mapResultToModel(result, model));
}

export function mapResultToModel<T extends Model>(result: object, model: ModelStatic<T>): T {
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

  const modelInstance = model.build(initRecord as CreationAttributes<T>, { isNewRecord: false, raw: true });

  Object.assign(modelInstance, includes);

  return modelInstance;
}

export function buildWhereComponent(whereOption: WhereOptions, model: ModelStatic<any>, mainAlias: string): string {
  const sequelize = model.sequelize;

  assert(sequelize != null, 'Model has not been initialized');

  const generator = sequelize
    .getQueryInterface()
    .queryGenerator;

  return generator.whereItemsQuery(
    whereOption,
    {
      model,
      mainAlias,
    },
  ).trim();
}

export function where(whereOption: WhereOptions, model: ModelStatic<any>, mainAlias: string);
export function where(clause: string): string;
export function where(clauseOrWhere: string | WhereOptions, model?: ModelStatic<any>, mainAlias?: string): string {
  if (!clauseOrWhere) {
    return '';
  }

  if (typeof clauseOrWhere === 'string') {
    return `WHERE ${clauseOrWhere}`;
  }

  assert(model != null);
  assert(mainAlias != null);

  return where(buildWhereComponent(clauseOrWhere, model, mainAlias));
}

export function andWhere(clause: WhereOptions | null, model: ModelStatic<any>, mainAlias: string);
export function andWhere(clause: string);
export function andWhere(clauseOrWhere: string | WhereOptions | null, model?: ModelStatic<any>, mainAlias?: string) {
  if (!clauseOrWhere) {
    return '';
  }

  if (typeof clauseOrWhere === 'string') {
    return `AND ${clauseOrWhere}`;
  }

  assert(model != null);
  assert(mainAlias != null);

  return andWhere(buildWhereComponent(clauseOrWhere, model, mainAlias));
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

export function buildOrder(orders, tableAlias: string, model?: ModelStatic<any>) {
  // TODO use QueryGenerator#getQueryOrders if they support $table.column$
  return orders
    .map(order => {
      // tableAlias, col, dir
      if (order.length === 3) {
        const [alias, column, dir] = order;

        const columnName = model ? model.modelDefinition.getColumnName(column) : column;

        return `"${alias}"."${columnName}" ${dir}`;
      }

      const column: string = order[0];
      const dir = order[1];

      // format $table.column$, used for referencing joined tables
      const associationReference = matchAssociationReference(column);
      if (associationReference) {
        return `"${associationReference[0]}"."${associationReference[1]}" ${dir}`;
      }

      const attributeToCol = model ? model.modelDefinition.getColumnNameLoose(column) : column;
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

export function tsEnum(theEnum: Record<string, string>) {
  return DataTypes.ENUM(...Object.values(theEnum));
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
    val = [...val];
  }

  return { [Op.in]: val };
}

export const POSTGRE_SMALLINT_MAX_VALUE = 32_767;

export const POSTGRE_INTEGER_MAX_VALUE = 2_147_483_647;
