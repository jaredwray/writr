
import * as express from "express";
import { Config } from "../src/config";

export function init(writr: any, url: string, express: express.Application, config: Config): void {
  
    //handle home
    express.get("/", async function(req: express.Request, res: express.Response) {
      let body = await writr.renderHome();
  
      res.send(body);
    });
  
    //handle posts
    express.get(url + "/:postID", async function(req: express.Request, res: express.Response) {
      let postID = req.query.postID;
      let previewKey = req.query.previewKey;
  
      if (postID) {
        let body = await writr.renderPost(postID, previewKey);
  
        res.send(body);
      } else {
        res.sendStatus(404);
        res.end();
      }
    });
  
    //handle tags
    express.get(url + "/tags/:tagID", async function(req: express.Request, res: express.Response) {
      let tagID = req.query.tagID;
  
      if (tagID) {
        let body = await writr.renderTag(tagID);
  
        res.send(body);
      } else {
        res.sendStatus(404);
        res.end();
      }
    });
  }