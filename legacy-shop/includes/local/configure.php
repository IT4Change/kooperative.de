<?php
/*
  Koop patch loader for the old osCommerce shop (shop.kooperative.de).
  Source: legacy-shop/ in the kooperative.de repository - see its README.md.

  osCommerce includes this file, if it exists, at the very start of
  includes/application_top.php ("local configuration"). We use that hook to let
  a patch take over a page without changing any of the shop's own files:

    includes/local/patches/<script>.php   takes over   <shop root>/<script>.php

  - Copy a patch into patches/ to switch it on, delete it to get the original
    page back. Deleting this file switches all patches off at once.
  - A patch always ends the request itself (it either renders its page or runs
    the original one), so the interrupted application_top never resumes.

  Must stay compatible with PHP 5.2: the shop still needs register_globals.
*/

if (!defined('KOOP_PATCH_RUNNING')) {
  $koop_patch_script = basename($_SERVER['SCRIPT_NAME']);
  $koop_patch_file = dirname(__FILE__) . '/patches/' . $koop_patch_script;
  if (preg_match('/^[a-z0-9_]+\.php$/', $koop_patch_script) && is_file($koop_patch_file)) {
    define('KOOP_PATCH_RUNNING', $koop_patch_script);
    include($koop_patch_file);
    exit;
  }
}
