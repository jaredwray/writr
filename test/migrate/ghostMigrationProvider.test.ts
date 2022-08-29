jest.mock("axios");
import axios from "axios";
import fs from "fs-extra";
import {ConsoleMessage} from "../../src/log";
import {GhostMigrationProvider} from "../../src/migrate/ghostMigrationProvider";
import {posts} from "../migration_example/ghost/posts";

describe('ghostMigrationProvider', () => {

  jest.spyOn(ConsoleMessage.prototype, 'info').mockImplementation(() => {});

  beforeEach(() =>{
    // @ts-ignore
    axios.delete.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const ghostMigration = new GhostMigrationProvider();

  it('should fetch all posts', async () => {

    // @ts-ignore
    axios.get.mockImplementation(() => {
      return  {
        data:  posts,
      }
    });

    const fetchedPost = await ghostMigration.fetchPosts('https://demo-site.ghots.io/?key=apikey');
    expect(fetchedPost.length).toBe(14);
  });


  it('should return an error when fetching posts', async () => {
    // @ts-ignore
    axios.get.mockImplementation(() => {
      throw new Error('Error');
    });

    try{
      await ghostMigration.fetchPosts('https://demo-site.ghots.io/?key=apikey');
      expect('Fetch failed').toBe('Fetch succeeded');
    } catch (error: any) {
      expect(error.message).toBe("Error");
    }
  });

  it('should save media', async () => {

    // @ts-ignore
    axios.get.mockImplementation(() => {
      return  {
        data: 'mediaData',
        headers: {
          'content-type': 'image/png'
        }
      }
    });

    const mediaFetched = {
      mediaUrl: 'https://static.ghost.org/v4.0.0/images/welcome-to-ghost.png',
      slug: 'welcome-to-ghost'
    };

    const filename = await ghostMigration.saveMedia(mediaFetched, './test_output/ghost');

    expect(filename).toBe('/images/welcome-to-ghost.png');

    fs.removeSync('./test_output/ghost');
  });

  it('should migrate posts to Writer', async () => {

    jest.spyOn(GhostMigrationProvider.prototype, 'fetchPosts')
      .mockImplementation(() => {
        return Promise.resolve(posts.posts);
      });

    jest.spyOn(GhostMigrationProvider.prototype, 'saveMedia')
      .mockImplementation(() => {
        return Promise.resolve('/images/welcome-to-ghost.png');
      });

    await ghostMigration.migrate('https://demo-site.ghosts.io/?key=apikey', './test_output/ghosts');

    expect(fs.readdirSync("./test_output/ghosts").length).toBe(7);

    fs.removeSync('./test_output/ghosts');
  });

  it('should return an error when something fail', async () => {
    const src = "https://demo-site.ghosts.io/?key=apikey";

    jest.spyOn(GhostMigrationProvider.prototype, 'fetchPosts')
      .mockImplementation(() => {
        throw new Error('Error while migrating Ghost site: ' + src);
      });

    try{
      await ghostMigration.migrate(src, './test_output/ghosts');
      expect('Migration failed').toBe('Migration succeeded');
    } catch (error: any) {
      expect(error.message).toBe('Error while migrating Ghost site: ' + src);
    }
  })

})
