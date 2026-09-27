'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

const DEEP_POPULATE = {
  seo: true,
  hero: { populate: ['primaryCta', 'secondaryCta', 'cards'] },
  authorityProof: { populate: ['stats'] },
  musicianRoster: true,
  problem: { populate: ['problems'] },
  solution: { populate: ['pillars'] },
  catalog: {
    populate: {
      services: true,
      packs: { populate: ['cta'] },
    },
  },
  testimonials: { populate: ['authorAvatar'] },
  contact: true,
  team: { populate: { members: { populate: ['photo'] } } },
  catalogPage: { populate: ['seo'] },
  musicianDetail: { populate: ['faqs'] },
  faq: { populate: ['items'] },
  legal: true,
  ctaBanner: { populate: ['primaryCta'] },
  sections: true,
  whatsapp: true,
};

module.exports = createCoreController('api::landing-page.landing-page', () => ({
  async find(ctx) {
    ctx.query = { ...ctx.query, populate: DEEP_POPULATE };
    return super.find(ctx);
  },
}));
