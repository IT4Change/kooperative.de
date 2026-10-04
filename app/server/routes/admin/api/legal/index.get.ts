import { listLegalOverview } from '../../../../utils/legalText'

/** Admin overview: every legal page with its live version and version count. */
export default defineEventHandler(async () => listLegalOverview(useDB()))
