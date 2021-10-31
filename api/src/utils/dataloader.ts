import DataLoader from 'dataloader';
import type { Model, ModelCtor } from 'sequelize-typescript';
import { isIn } from './sequelize-utils';

export function singlePropertyDataLoader<M extends Model, K extends keyof M['_attributes']>(model: ModelCtor<M>, property: K): DataLoader<M['_attributes'][K], M | null> {

  type PropertyType = M['_attributes'][K];

  return new DataLoader<PropertyType, M | null>(
    async (keys: PropertyType[]) => {
      const res = await model.findAll({
        // @ts-expect-error
        where: {
          [property]: isIn(keys),
        },
      });

      return keys.map(key => res.find(val => val[property] === key) ?? null);
    },
    { cache: false },
  );
}

export function getBySinglePropertyDl<M extends Model, K extends keyof M['_attributes']>(model: ModelCtor<M>, property: K): (key: M['_attributes'][K]) => Promise<M | null> {
  const dl = singlePropertyDataLoader(model, property);

  return dl.load.bind(dl);
}
