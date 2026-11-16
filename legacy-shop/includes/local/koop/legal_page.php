<?php
/*
  Prints legal texts from the database tables the new shop maintains
  (koop_legal_text_live / koop_legal_text_version, edited in its admin under
  "Rechtstexte") inside the old shop's page frame.

  Included by a patch in ../patches/, which sets:
    $koop_legal_title       page heading (ASCII, umlauts as entities)
    $koop_legal_breadcrumb  breadcrumb label (ASCII)
    $koop_legal_parts       slug => section heading ('' = none), printed in order

  If the first part cannot be loaded (no live version, table missing, database
  error) the original page is shown instead - an Impressum must never vanish.

  body_html is pure ASCII (every other character is a numeric entity), so it
  prints correctly whatever charset the connection or the page uses.

  Must stay compatible with PHP 5.2.
*/

// The shop environment. application_top was interrupted by the patch loader
// before it set anything up; this second run is the complete one.
// KOOP_PATCH_RUNNING keeps it from entering the loader again.
require('includes/application_top.php');

/** The live HTML of a legal text, or '' if there is none or the query fails. */
function koop_legal_fetch($slug) {
  // Raw mysql_query instead of tep_db_query: the latter die()s on any error,
  // and a missing table must lead to the fallback, not to a dead page.
  $sql = "select v.body_html from koop_legal_text_live l, koop_legal_text_version v"
       . " where v.id = l.version_id and l.slug = '" . tep_db_input($slug) . "' limit 1";
  $result = @mysql_query($sql, $GLOBALS['db_link']);
  if (!$result) return '';
  $row = mysql_fetch_assoc($result);
  return ($row && isset($row['body_html'])) ? (string)$row['body_html'] : '';
}

$koop_legal_html = array();
foreach ($koop_legal_parts as $koop_slug => $koop_heading) {
  $koop_html = koop_legal_fetch($koop_slug);
  if ($koop_html !== '') $koop_legal_html[$koop_slug] = $koop_html;
}

$koop_legal_slugs = array_keys($koop_legal_parts);
if (!isset($koop_legal_html[$koop_legal_slugs[0]])) {
  // Fallback: run the original page, minus its own application_top include -
  // that has already happened above, and a second one would redeclare functions.
  $koop_src = @file_get_contents(KOOP_PATCH_RUNNING);
  $koop_count = 0;
  if ($koop_src !== false) {
    $koop_src = str_replace("require('includes/application_top.php');", '', $koop_src, $koop_count);
  }
  if ($koop_count === 1) {
    eval('?>' . $koop_src);
  } else {
    echo 'Diese Seite ist vor&uuml;bergehend nicht verf&uuml;gbar.';
  }
  exit;
}

$breadcrumb->add($koop_legal_breadcrumb, tep_href_link(KOOP_PATCH_RUNNING));
?>
<!doctype html public "-//W3C//DTD HTML 4.01 Transitional//EN">
<html <?php echo HTML_PARAMS; ?>>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=<?php echo CHARSET; ?>">
<title><?php echo TITLE; ?></title>
<base href="<?php echo (($request_type == 'SSL') ? HTTPS_SERVER : HTTP_SERVER) . DIR_WS_CATALOG; ?>">
<link rel="stylesheet" type="text/css" href="stylesheet.css">
<style type="text/css">
  .koop-legal, .koop-legal p, .koop-legal li, .koop-legal td, .koop-legal th { font-size: 12px; line-height: 18px; }
  .koop-legal h2 { font-size: 13px; margin: 18px 0 6px 0; }
  .koop-legal h3 { font-size: 12px; margin: 14px 0 4px 0; }
  .koop-legal h2.koop-legal-part { font-size: 14px; margin-top: 32px; padding-top: 12px; border-top: 1px solid #cccccc; }
  .koop-legal p { margin: 0 0 9px 0; }
  .koop-legal ul, .koop-legal ol { margin: 0 0 9px 0; padding-left: 22px; }
  .koop-legal table { border-collapse: collapse; margin: 0 0 12px 0; }
  .koop-legal th, .koop-legal td { border: 1px solid #cccccc; padding: 3px 6px; text-align: left; vertical-align: top; }
  .koop-legal th { background: #f2f2f2; font-weight: bold; }
  .koop-legal mark.legal-placeholder { background: #fde68a; }
</style>
</head>
<body bgcolor="#ffffff">
<?php require(DIR_WS_INCLUDES . 'header.php'); ?>
<br>
<table width="<?php echo TABLE_WIDTH; ?>" border="0" cellspacing="0" cellpadding="0" align="center">
  <tr>
    <td><font size="3"><b><?php echo $koop_legal_title; ?></b></font><br><br></td>
  </tr>
</table>
<table width="635" border="0" cellspacing="0" cellpadding="0" align="center">
  <tr>
    <td class="koop-legal">
<?php
foreach ($koop_legal_parts as $koop_slug => $koop_heading) {
  if (!isset($koop_legal_html[$koop_slug])) continue;
  if ($koop_heading !== '') echo '<h2 class="koop-legal-part">' . $koop_heading . "</h2>\n";
  echo $koop_legal_html[$koop_slug] . "\n";
}
?>
    </td>
  </tr>
</table>
<br>
<?php require(DIR_WS_INCLUDES . 'footer.php'); ?>
<br>
</body>
</html>
<?php require(DIR_WS_INCLUDES . 'application_bottom.php'); ?>
