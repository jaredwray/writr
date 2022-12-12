import { Tag } from '../src/tag';
import { Post } from '../src/post';

describe('Tag', () => {

  it('tag should have a valid name', () => {
    let tag = new Tag('cow');

    expect(tag.name).toBe('cow');
  });

  it('tag should have a valid name with no space', () => {
    let tag = new Tag(' cow');

    expect(tag.name).toBe('cow');
  });

  it('tag should have a valid name on capital', () => {
    let tag = new Tag(' Cow');

    expect(tag.name).toBe('Cow');
  });

  it('tag should have a valid id', () => {
    let tag = new Tag("How's now: brown cow! -");

    expect(tag.id).toBe("how-s-now-brown-cow");
  });

  it('tag clone', () => {
    let tag = new Tag("How's now: brown cow! -");

    tag.posts.push(new Post());

    let obj = Tag.create(tag);

    expect(obj.id).toBe("how-s-now-brown-cow");
    expect(obj.posts.length).toBe(1);
  });

  it('tag clone with no posts', () => {
    let tag = new Tag("How's now: brown cow! -");
    tag.posts = [];
    let obj = Tag.create(tag);

    expect(obj.id).toBe("how-s-now-brown-cow");
    expect(obj.posts.length).toBe(0);
  });

});