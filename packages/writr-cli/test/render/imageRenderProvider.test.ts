import { Config } from "../../src/config";
import { DataService } from "../../src/data/dataService";
import { ImageRenderProvider } from "../../src/render/imageRenderProvider";

describe("imageProvider", () => {
  let config: Config = new Config();

  beforeEach(() => {
    config.loadConfig("./blog_example/config.json");
    config.output + "/image_render";
  });

  it("render (long running)", async () => {
    let imageProvider = new ImageRenderProvider();
    
    let ds = new DataService(config);

    let val = await imageProvider.render(ds, config);

    expect(val).toBe(true);
  });

  
});
