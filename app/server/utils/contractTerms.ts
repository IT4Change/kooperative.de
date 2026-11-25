import { legalPage } from '../../app/data/legalPages'

import { getLiveLegalText } from './legalText'

import type { LegalSlug } from '../../app/data/legalPages'
import type { Pool } from 'mysql2/promise'

/**
 * The contract terms a customer must receive on a durable medium (§ 312f
 * Abs. 2 BGB): the AGB and the Widerrufsbelehrung incl. the model withdrawal
 * form (Art. 246a § 1 Abs. 2 EGBGB). They travel inside the receipt mail, so
 * the mail log keeps the exact wording that applied to the order.
 */
export interface ContractTerm {
  slug: LegalSlug
  title: string
  versionNo: number
  html: string
  text: string
}

export const CONTRACT_TERM_SLUGS: readonly LegalSlug[] = ['agb', 'widerruf']

/**
 * The live versions of the contract terms. Never throws: an order must not fail
 * because a text is missing — the mail then goes out without it, and the gap is
 * logged so the operator can send the terms by hand.
 */
export async function loadContractTerms(db: Pool): Promise<ContractTerm[]> {
  const terms: ContractTerm[] = []
  for (const slug of CONTRACT_TERM_SLUGS) {
    try {
      const live = await getLiveLegalText(db, slug)
      if (live) {
        terms.push({
          slug,
          title: legalPage(slug).title,
          versionNo: live.versionNo,
          html: live.html,
          text: live.bodyMd,
        })
        continue
      }
      console.warn(`[contractTerms] ${slug}: no live version — receipt goes out without it`)
    } catch (err) {
      console.error(`[contractTerms] ${slug}: could not be loaded:`, err)
    }
  }
  return terms
}
