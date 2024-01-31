#!/usr/bin/env ts-node

import * as process from 'node:process';
import Writr from '../dist/writr.js';

const writr = new Writr();

await writr.execute(process);
