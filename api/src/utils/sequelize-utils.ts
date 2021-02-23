import { DataTypes } from 'sequelize';

export function tsEnum(theEnum: { [key: string]: string }) {
  return DataTypes.ENUM(...Object.values(theEnum));
}
