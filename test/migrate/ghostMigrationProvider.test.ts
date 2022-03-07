jest.mock('node-fetch');
import fetch from 'node-fetch';
import * as fs from "fs-extra";
import {GhostMigrationProvider} from "../../src/migrate/ghostMigrationProvider";
import {posts} from "../ghost_example/_mocks_";

describe('ghostMigrationProvider', () => {

  beforeEach(() =>{
    // @ts-ignore
    fetch.mockReset()
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const ghostMigration = new GhostMigrationProvider();

  it('should fetch all posts', async () => {

    // @ts-ignore
    fetch.mockResolvedValue({
      json: jest.fn().mockResolvedValue(posts),
    });

    const fetchedPost = await ghostMigration.fetchPosts('https://demo-site.ghots.io/?key=apikey');
    expect(fetchedPost.length).toBe(14);
  });

  it('should return an error when fetching posts', async () => {
    // @ts-ignore
    fetch.mockImplementation(() => {
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
    fetch.mockResolvedValueOnce({
      buffer: () => Buffer.from('test'),
      headers: {
        get: jest.fn().mockReturnValue('image/png')
      }
      });

    const mediaFetched = {
      mediaUrl: 'https://static.ghost.org/v4.0.0/images/welcome-to-ghost.png',
      slug: 'welcome-to-ghost'
    };

    const filename = await ghostMigration.saveMedia(mediaFetched, './test/output');

    expect(filename).toBe('/images/welcome-to-ghost.png');

    fs.removeSync('./test/output');
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

    await ghostMigration.migrate('https://demo-site.ghosts.io/?key=apikey', './test/ghosts');

    expect(fs.readdirSync("./test/ghosts").length).toBe(7);

    fs.removeSync('./test/ghosts');
  });

  it('should return an error when something fail', async () => {
    const src = "https://demo-site.ghosts.io/?key=apikey";

    jest.spyOn(GhostMigrationProvider.prototype, 'fetchPosts')
      .mockImplementation(() => {
        throw new Error('Error while migrating Ghost site: ' + src);
      });

    try{
      await ghostMigration.migrate(src, './test/ghosts');

      expect('Migration failed').toBe('Migration succeeded');
    } catch (error: any) {
      expect(error.message).toBe('Error while migrating Ghost site: ' + src);
    }
  })

})
