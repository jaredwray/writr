import {Setup} from "../../src/utils/setup";
import * as fs from "fs-extra";

describe('setup', () => {

  it('should generate a sample site', async () => {

    await new Setup('blog').init();
    expect(fs.readdirSync("./blog").length).toBe(3);

    fs.removeSync('./blog');
  })

  it('should return an error if the directory exist', async () => {

    try{
      fs.mkdirSync('./blog');
      await new Setup('blog').init();
    } catch (error: any){
      expect(error.message).toBe('Directory already exists');
    } finally {
      fs.removeSync('./blog');
    }
  })

})
