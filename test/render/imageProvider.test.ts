import { expect } from "chai";
import { Config } from "../../src/config";
import "mocha";
import { DataService } from "../../src/data/dataService";
import * as del from "del";
import * as fs from "fs-extra";
import { ImageProvider } from "../../src/render/imageProvider";

describe("imageProvider", () => {
  let config: Config = new Config();

  beforeEach(() => {
    config.loadConfig("./blog_example/config.json");
  });

  it("render (long running)", async () => {
    let imageProvider = new ImageProvider();
    
    let ds = new DataService(config);

    let val = await imageProvider.render(ds, config);

    //cleanup
    if (fs.existsSync(config.output)) {
        del.sync(config.output);
    }

    expect(val).to.equal(true);
  });

  
});
