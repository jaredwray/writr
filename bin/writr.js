#!/usr/bin/env ts-node --esm --inspect --experimental-specifier-resolution=node --es-module-specifier-resolution=node

import {Writr} from '../dist/index.js';

const writr = new Writr();

writr.parseCLI(process);
