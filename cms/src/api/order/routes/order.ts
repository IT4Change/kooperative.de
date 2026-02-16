/**
 * order router
 *
 * Custom router that applies rate-limit middleware to the create action.
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreRouter("api::order.order", {
  config: {
    create: {
      middlewares: ["api::order.rate-limit"],
    },
  },
});
