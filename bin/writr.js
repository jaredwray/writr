#!/usr/bin/env ts-node

import {process} from 'node:process';
import {Writr} from '../dist/index.js';

const writr = new Writr();

writr.parseCLI(process);
