<?php
/*
  "Vertrag widerrufen" in the footer of every page of the old shop (§ 356a BGB:
  the withdrawal function must be reachable throughout the withdrawal period).
  Source: legacy-shop/ in the kooperative.de repository - see its README.md.

  The old shop has no form of its own: the link leads to the withdrawal page of
  the new shop, which takes declarations for orders from both shops.

  Works as an output filter, so no file of the shop changes: the finished page
  gets one more cell right after the footer's "Impressum" cell. A page without
  that cell (popups, redirects, downloads) passes through byte for byte.
  Delete this file to remove the link again.

  Must stay compatible with PHP 5.2.
*/

// Where the withdrawal function lives. Check before copying to the server.
if (!defined('KOOP_WITHDRAWAL_URL')) define('KOOP_WITHDRAWAL_URL', 'https://neu.kooperative.de/vertrag-widerrufen');

function koop_withdrawal_link_filter($html) {
  $cell = '<td nowrap align="center"><a title="Vertrag widerrufen" href="'
    . htmlspecialchars(KOOP_WITHDRAWAL_URL) . '" class="Othermenu">Vertrag widerrufen</a></td>';
  $count = 0;
  $out = preg_replace(
    '/(<a\b[^>]*href="[^"]*imprint\.php[^"]*"[^>]*>Impressum<\/a>\s*<\/td>)/',
    '$1' . $cell,
    $html,
    1,
    $count
  );
  // preg_replace answers NULL on an error (e.g. a backtrack limit): never let
  // the filter cost the customer the page.
  if ($out === null || $count === 0) return $html;
  return $out;
}

ob_start('koop_withdrawal_link_filter');
