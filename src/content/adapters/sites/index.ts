// The registered site adapters (task 10), in rough order of CZ e-shop traffic. Kept small
// on purpose: each adapter is a maintenance liability (markup drifts), so the MVP ships a
// deliberate few and grows incrementally per real user need, not preventively. Adding one is
// a one-line import here plus its `sites/<name>.ts` file.

import type { SiteAdapter } from '../types';

import { alza } from './alza';
import { mall } from './mall';
import { datart } from './datart';
import { czc } from './czc';
import { notino } from './notino';

export const adapters: SiteAdapter[] = [alza, mall, datart, czc, notino];
