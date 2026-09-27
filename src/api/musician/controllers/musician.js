'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

const DEEP_POPULATE = {
  photo: true,
  media: true,
  reviews: true,
  seo: true,
};

module.exports = createCoreController('api::musician.musician', () => ({
  async find(ctx) {
    ctx.query = { ...ctx.query, populate: DEEP_POPULATE };
    return super.find(ctx);
  },
  async findOne(ctx) {
    ctx.query = { ...ctx.query, populate: DEEP_POPULATE };
    return super.findOne(ctx);
  },
}));
