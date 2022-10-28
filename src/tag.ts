import { Post } from "./post.js";

export class Tag {
  name: string = "";
  posts: Array<Post> = new Array<Post>();

  constructor(name: string) {
    this.name = name.trim();
  }

  get id(): string {

    let result = this.name.toLowerCase().replace(/[^a-z0-9+]+/gi, " ").trim();
    result = result.split(" ").join("-");

    return result;
  }

  async toObject(): Promise<any> {
    let result: any = {};
    result.name = this.name;
    result.id = this.id;
    result.posts = [];

    for (const post of this.posts) {
      result.posts.push(await post.toObject());
    }

    return result;
  }

  static create(obj: any): Tag {
    let result = new Tag(obj.name);

    if (obj.posts) {
      for (let i = 0; i < obj.posts.length; i++) {
        let p = Post.create(obj.posts[i]);

        result.posts.push(p);
      }
    }

    return result;
  }
}
