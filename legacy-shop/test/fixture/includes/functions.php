<?php
/*
  Fixture functions. Required once per request from application_top.php - a
  second full bootstrap in the same request would die on "Cannot redeclare",
  just as it would in the real shop.
*/
function tep_href_link($page) { return 'https://shop.test/' . $page; }
function tep_db_input($string) { return addslashes($string); }
function tep_image_button($image, $alt) { return '[' . $alt . ']'; }

class breadcrumb {
  var $trail = array();
  function add($title, $link) { $this->trail[] = $title; }
}

if (!function_exists('mysql_query')) {
  function mysql_query($sql, $link) {
    $mode = getenv('KOOP_TEST_DB');
    if ($mode === 'fail' || $link !== 'fixture-link') return false;
    $texts = json_decode((string)$mode, true);
    if (!is_array($texts) || !preg_match("/l\\.slug = '([a-z]+)'/", $sql, $m)) return array();
    return isset($texts[$m[1]]) ? array(array('body_html' => $texts[$m[1]])) : array();
  }
  function mysql_fetch_assoc(&$result) { return array_shift($result); }
}
