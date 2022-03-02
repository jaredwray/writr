jest.mock('node-fetch');
import fetch from 'node-fetch';
import * as fs from "fs-extra";

import {WordpressMigrationProvider} from "../../src/migrate/wordpressMigrationProvider";
import {posts, media, categories} from "../wordpress_example/_mocks_";

const {Response} = jest.requireActual('node-fetch');

describe('wordpressMigrationProvider', () => {

    beforeEach(() =>{
       // @ts-ignore
        fetch.mockReset()
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    const wordpressMigration = new WordpressMigrationProvider();

    it('should fetch all posts', async () => {

        // @ts-ignore
        fetch.mockResolvedValue({
            json: jest.fn().mockResolvedValue(posts),
            headers: {
                get: jest.fn().mockReturnValue(2)
            }
        });

        const fetchedPost = await wordpressMigration.fetchPosts('');
        expect(fetchedPost.length).toBe(2);
    });

    it('should return an error when fetching posts', async () => {
        // With no headers we will throw an error
        // @ts-ignore
        fetch.mockResolvedValue({
            json: jest.fn().mockResolvedValue(posts),
        });

        try{
            await wordpressMigration.fetchPosts('');
            expect('Fetch failed').toBe('Fetch succeeded');
        } catch (error: any) {
            expect(error.message).toBe("Cannot read property 'get' of undefined");
        }
    });

    it('should fetch media data', async () => {
        // @ts-ignore
        fetch.mockResolvedValueOnce(new Response(JSON.stringify(media)));
        const mediaFetched = await wordpressMigration.fetchMedia('url', 'mediaId');
        expect(mediaFetched).toMatchObject(media);
    });

    it('should return an error when fetching media', async () => {
        // @ts-ignore
        fetch.mockResolvedValueOnce(new Response(null));

        const mediaFetched = await wordpressMigration.fetchMedia('url', 'mediaId');

        expect(mediaFetched).toBeNull();
    });

    it('should return an error when not media fetched passed', async () => {
        try {
            await wordpressMigration.saveMedia(null, './test/blog');
            expect('Fetch failed').toBe('Fetch succeeded');
        } catch (error: any) {
            expect(error.message).toBe('No media found');
        }
    })

    it('should save media', async () => {

        // @ts-ignore
        fetch.mockResolvedValueOnce(new Response({blob: {}}));

        const filename = await wordpressMigration.saveMedia(media, './test/blog');

        expect(filename).toBe('/images/article-one-image.png');

        fs.removeSync('./test/blog');
    })

    it('should fetch categories per post', async () => {
        // @ts-ignore
        fetch.mockResolvedValueOnce(new Response(JSON.stringify(categories)));
        const categoriesFetched = await wordpressMigration.fetchCategoriesPerPost('url', 'postId');

        expect(categoriesFetched.length).toBe(3);
    });

    it('should return an error when fetching categories data', async () => {
        // @ts-ignore
        fetch.mockResolvedValueOnce(new Response(null));

        const categories = await wordpressMigration.fetchCategoriesPerPost('url', 'postId');

        expect(categories).toBeNull();
    });

    it('should migrate post to Writer', async () => {

        jest.spyOn(WordpressMigrationProvider.prototype, 'fetchPosts')
          .mockImplementation(() => {
              return Promise.resolve(posts);
          });

        jest.spyOn(WordpressMigrationProvider.prototype, 'fetchCategoriesPerPost')
          .mockImplementation(() => {
              return Promise.resolve(categories);
          });

        jest.spyOn(WordpressMigrationProvider.prototype, 'fetchMedia')
          .mockImplementation(() => {
              return Promise.resolve(media);
          });

        // @ts-ignore
        fetch.mockResolvedValueOnce(new Response({blob: {}}));

        await wordpressMigration.migrate('url', './test/output');

        expect(fs.readdirSync("./test/output").length).toBe(2);
        expect(fs.readdirSync("./test/output/images").length).toBe(1);

        fs.removeSync('./test/output');
    });

    it('should return an error when something fail', async () => {
        const src = "https://demowp.com";

        jest.spyOn(WordpressMigrationProvider.prototype, 'fetchPosts')
          .mockImplementation(() => {
              throw new Error('Error while migrating WordPress site: ' + src);
          });

        try{
            await wordpressMigration.migrate(src, './test/output');

            expect('Migration failed').toBe('Migration succeeded');
        } catch (error: any) {
            expect(error.message).toBe('Error while migrating WordPress site: ' + src);
        }
    })
})
