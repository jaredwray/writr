import fs from "fs-extra";
import { Writr } from "../src";
import { Config } from "../src/config";
import { Setup } from "../src/utils/setup";
import {ConsoleMessage} from "../src/log";
import {Migrate} from "../src/migrate";
import {SiteGenerator} from "../src/generator";
import {Serve} from "../src/serve";

describe('Writr', () => {
  jest.spyOn(ConsoleMessage.prototype, 'error').mockImplementation(() => {});
  jest.spyOn(ConsoleMessage.prototype, 'info').mockImplementation(() => {});

  let config: Config = new Config();

  beforeEach(() => {
    config.loadConfig("./blog_example/config.json");
  });

  it('cli should run build command successfully', async () => {
    jest.spyOn(SiteGenerator.prototype, 'run').mockImplementation(() => {
      return Promise.resolve(true)
    });

    const writr = new Writr();

    process.argv = ['', ''];

    await writr.parseCLI(process)

    expect(SiteGenerator.prototype.run).toHaveBeenCalled();
  });

  it('cli should run build command and return an error', async () => {
    jest.spyOn(SiteGenerator.prototype, 'run').mockImplementation(() => {
      throw new Error('Error');
    });
    try{
      const writr = new Writr();

      process.argv = ['', ''];

      await writr.parseCLI(process)

    } catch (error: any) {
      expect(error.message).toBe('Error');
    }
  });

  it('cli should run the init command with app name',async () => {
    const writr = new Writr();

    process.argv = ['', '', 'init', 'blog'];

    await writr.parseCLI(process);

    expect(fs.readdirSync("./blog").length).toBe(3);

    fs.removeSync('./blog');
  });

  it('cli should run the init command without app name', async () => {
    const writr = new Writr();

    process.argv = ['', '', 'init'];

    await writr.parseCLI(process);

    expect(fs.readdirSync("./Blog").length).toBe(3);

    fs.removeSync('./Blog');
  })

  it('cli should run the init command and return error',async () => {
    try{
      fs.mkdirSync('./blog');

      const writr = new Writr();

      process.argv = ['', '', 'init', 'blog'];

      await writr.parseCLI(process);

    } catch (error: any){
      expect(error.message).toBe('Directory already exists');
    } finally {
      fs.removeSync('./blog');
    }
  })

  it('cli should run new command successfully', async() => {
    jest.spyOn(Setup.prototype, 'new').mockImplementation(() => {
      return Promise.resolve();
    })

    const writr = new Writr();

    process.argv = ['', '', 'new'];

    await writr.parseCLI(process);

    expect(Setup.prototype.new).toHaveBeenCalled();
  })

  it('cli should run new command and return an error', async () => {
    jest.spyOn(Setup.prototype, 'new').mockImplementation(() => {
      throw new Error('Error');
    })
    try{
      const writr = new Writr();

      process.argv = ['', '', 'new'];

      await writr.parseCLI(process);
    } catch (error: any) {
      expect(error.message).toBe('Error');
    }
  })

  it('cli should run migrate command successfully', async () => {
    jest.spyOn(Migrate.prototype, 'migrate').mockImplementation(() => {
      return Promise.resolve();
    })

    const writr = new Writr();

    process.argv = ['', '', 'migrate', 'jekyll', 'option 1', 'option 2'];

    await writr.parseCLI(process);

    expect(Migrate.prototype.migrate).toHaveBeenCalled();
  })

  it('cli should run migrate command and return an error', async () => {
    jest.spyOn(Migrate.prototype, 'migrate').mockImplementation(() => {
      throw new Error('Error');
    })
    try{
      const writr = new Writr();

      process.argv = ['', '', 'migrate', 'demo1', 'demo2'];

      await writr.parseCLI(process);
    } catch (error: any) {
      expect(error.message).toBe('Error');
    }
  })

  it('cli should run serve command successfully', async () => {
    jest.spyOn(Serve.prototype, 'run').mockImplementation(() => {
      return Promise.resolve();
    })

    const writr = new Writr();

    process.argv = ['', '', 'serve'];

    await writr.parseCLI(process);

    expect(Serve.prototype.run).toHaveBeenCalled();
  })

  it('cli should run serve command and return an error', async () => {
    jest.spyOn(Serve.prototype, 'run').mockImplementation(() => {
      throw new Error('Error');
    })
    try{
      const writr = new Writr();

      process.argv = ['', '', 'serve'];

      await writr.parseCLI(process);
    } catch (error: any) {
      expect(error.message).toBe('Error');
    }
  })

});
