#!/bin/bash
. /etc/profile

set -e

pnpm install

pnpm releasae
