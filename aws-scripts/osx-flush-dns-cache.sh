#/bin/bash
# Only root can run
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root" 1>&2
   exit 1
fi
# I can never remember this
dscacheutil -flushcache; killall -HUP mDNSResponder;

