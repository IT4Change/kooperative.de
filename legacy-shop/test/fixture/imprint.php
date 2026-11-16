<?php
  // Stand-in for the shop's own imprint.php. run.sh replaces it with the real page
  // when the old shop's files are available (old/ftp-data/shop, not in git).
  require('includes/application_top.php');
  echo "ORIGINAL imprint.php\n";
