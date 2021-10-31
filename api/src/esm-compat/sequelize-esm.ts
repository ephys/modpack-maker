import SequelizePkg from 'sequelize';
import type { Sequelize as TSequelize, Op as TOp, ForeignKeyConstraintError as TForeignKeyConstraintError, Model as TModel, WhereOptions } from 'sequelize';

/**
 * Temporary Module until sequelize supports ESM out of the box.
 */

/* eslint-disable max-len,@typescript-eslint/no-redeclare */

export const QueryTypes = SequelizePkg.QueryTypes;
export const DataTypes = SequelizePkg.DataTypes;

export const Sequelize = SequelizePkg.Sequelize as unknown as TSequelize;
export type Sequelize = TSequelize;

export const Model = SequelizePkg.Model;
export type Model = TModel;

export const Op = SequelizePkg.Op as unknown as typeof TOp;
// export type Op = typeof TOp;

export const ForeignKeyConstraintError = SequelizePkg.ForeignKeyConstraintError as unknown as typeof TForeignKeyConstraintError;
export type ForeignKeyConstraintError = TForeignKeyConstraintError;

export type { WhereOptions };
