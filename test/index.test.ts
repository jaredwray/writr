import * as fs from "fs-extra";
import { Writr } from "../src/index";
import { Config } from "../src/config";
import { DataService } from "../src/data/dataService";

describe('Writr', () => {

  let config: Config = new Config();

  beforeEach(() => {
    config.loadConfig("./blog_example/config.json");
  });

  it("parse CLI", () => {
    let writr = new Writr();

    process.argv = [ '-c', './test/blog/config-test2.json', '-o', './out' ];

    writr.parseCLI(process);

    if(writr.config) {
      expect(writr.config.program.output).toBe("./out");
    } else {
      fail();
    }
  });

  it("cli run", async () => {
    let writr = new Writr();

    writr.parseCLI(process);

    writr.config = config;
    writr.data = new DataService(config);

    //create directory
    fs.ensureDirSync(config.output);

    let val = await writr.runCLI();

    expect(val).toBe(true);
  });

  it("cli run on path", async () => {
    let writr = new Writr();

    let p: any = {};
    p.argv = [ '',
    '',
    '-p',
    './blog_example' ];

    writr.parseCLI(p);

    if(writr.config) {
      expect(writr.config.path).toBe("./blog_example");
    } else {
      fail();
    }
  });

  it("cli run with no data set or config", async () => {
    let writr = new Writr();

    let p: any = {};
    p.argv = [ '',
    '',
    '-c', './blog_example/config.json', '-o', './out' ];

    writr.parseCLI(p);

    writr.config = undefined;
    writr.data = undefined;

    let val = await writr.runCLI();

    expect(val).toBe(false);
  });

  it('cli should parse jekyll and output params to migrate', async () => {
    const writr = new Writr();

    process.argv = ['', '', '-m', 'jekyll', './jekyll-site', './out' ];

    writr.parseCLI(process);

    const [src, dest] = writr.config?.program.args;

    expect(src).toBe('./jekyll-site');
    expect(dest).toBe('./out');
  });

  it('cli should run the init command',async () => {
    const writr = new Writr();

    process.argv = ['', '', 'init', 'blog'];

    writr.parseCLI(process);

    expect(fs.readdirSync("./blog").length).toBe(3);

    fs.removeSync('./blog');
  });

  it('cli should run the init command and return error',async () => {
    try{
      fs.mkdirSync('./blog');

      const writr = new Writr();

      process.argv = ['', '', 'init', 'blog'];

      writr.parseCLI(process);

    } catch (error: any){
      expect(error.message).toBe('Directory already exists');
    } finally {
      fs.removeSync('./blog');
    }
  })

});
