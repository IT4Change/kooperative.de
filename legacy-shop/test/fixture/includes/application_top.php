<?php
/*
  Stand-in for the old shop's includes/application_top.php. The first lines
  match the real file (they run before the patch loader hooks in); the rest
  provides just enough of the shop for the original pages and the patches.
*/
define('PAGE_PARSE_START_TIME', microtime());
error_reporting(E_ALL & ~E_NOTICE);

if (file_exists('includes/local/configure.php')) include('includes/local/configure.php');

// Like the real shop, functions and classes live in files required from here
// on - declaring one in this file itself would be hoisted at compile time and
// break the patch loader's second bootstrap (run.sh checks the real file).
require('includes/functions.php');

define('HTML_PARAMS', 'dir="LTR" lang="de"');
define('CHARSET', 'iso-8859-1');
define('TITLE', 'Kooperative Duernau');
define('HTTP_SERVER', 'http://shop.test');
define('HTTPS_SERVER', 'https://shop.test');
define('DIR_WS_CATALOG', '/');
define('DIR_WS_INCLUDES', 'includes/');
define('DIR_WS_LANGUAGES', 'includes/languages/');
define('TABLE_WIDTH', '760');
define('FILENAME_CONDITIONS', 'conditions.php');
define('FILENAME_SHIPPING', 'shipping.php');
$request_type = 'SSL';
$language = 'german';

$breadcrumb = new breadcrumb();

// The database: KOOP_TEST_DB holds a JSON object slug => body_html, or "fail"
// to make every query fail (stubs in functions.php, only defined where the mysql
// extension is missing - PHP 7+ - which is why the smoke test runs on a current PHP).
$db_link = 'fixture-link';
