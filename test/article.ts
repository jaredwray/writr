import { Article } from '../src/classes/article';
import { expect } from 'chai';
import 'mocha';

describe('Article', () => {

  it('should return the filePath name', () => {
    let article = new Article('file-path-name');

    expect(article.filePath).to.equal('file-path-name');
  });

});