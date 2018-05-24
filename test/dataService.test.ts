import { expect } from 'chai';
import 'mocha';

import {Config} from '../src/classes/config';
import {DataService} from '../src/services/dataService'
import * as moment from 'moment';

describe('Data Service', () => {

    let config : Config = new Config();

    before(() => {

        config.postPath = __dirname + '/blog';
        config.contentPath = __dirname + '/blog/content';
        config.templatePath = __dirname + '/blog/templates';

    });

    it('get a provider based on the config', () => {
        let ds = new DataService(config);

        expect(ds.getProvider()).to.not.equal(undefined);
    });

    it('format name correctly', () => {
        let ds = new DataService(config);

        expect(ds.formatName('blAh ')).to.equal(`blah`);
    });


});