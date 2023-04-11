import type { Attributes, Model, ModelStatic } from '@sequelize/core';
import DataLoader from 'dataloader';
import { isIn } from './sequelize-utils.js';

export function singlePropertyDataLoader<
  M extends Model,
  K extends keyof Attributes<M>,
>(model: ModelStatic<M>, property: K): DataLoader<Attributes<M>[K], M | null> {

  type PropertyType = M['_attributes'][K];

  return new DataLoader<PropertyType, M | null>(
    async (keys: PropertyType[]) => {
      const res = await model.findAll({
        // @ts-expect-error -- typing too complex
        where: {
          [property]: isIn(keys),
        },
      });

      return keys.map(key => res.find(val => val[property] === key) ?? null);
    },
    { cache: false },
  );
}

export function getBySinglePropertyDl<
  M extends Model,
  K extends keyof Attributes<M>,
>(model: ModelStatic<M>, property: K): (key: Attributes<M>[K]) => Promise<M | null> {
  const dl = singlePropertyDataLoader(model, property);

  return dl.load.bind(dl);
}
