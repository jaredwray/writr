import { expect } from 'chai';
import { Config } from '../src/classes/config';
import { FileDataProvider } from '../src/providers/fileDataProvider'; 
import 'mocha';

describe('Writr', () => {

  beforeEach(() => {

    let config : Config = new Config();
    config.postPath = __dirname + '/blog';
    config.contentPath = __dirname + '/blog/content';
    config.templatePath = __dirname + '/blog/templates';

  });

  it('config gets setup in init', () => {



    expect(1).to.equal(1);
  });
/*
  it('render the home page', () => {
    let body = wr.renderHome();

    expect(body).to.contain('Article Simple');
  });
 
  it('render a post', () => {
    let body = wr.renderPost('article-simple');

    expect(body).to.contain('Article Simple');
  });
*/ 
});