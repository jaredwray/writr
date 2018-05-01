import { Post } from '../src/classes/post';
import { expect } from 'chai';
import 'mocha';

describe('Post', () => {

  it('should return the filePath name', () => {
    let post = new Post('file-path-name');

    expect(post.filePath).to.equal('file-path-name');
  });

});