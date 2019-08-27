import { Post } from "./post";

export class Tag {
  name: string = "";
  posts: Array<Post> = new Array<Post>();

  constructor(name: string) {
    this.name = name;
  }

  isPublished(): boolean {
    let result = false;

    this.posts.forEach(post => {
      if (post.isPublished()) {
        result = true;
      }
    });

    return result;
  }

  getUrlName(): string {
    let result = "";

    let simpleUrl = this.name.replace(" ", "-").toLowerCase();
    result = simpleUrl;


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
