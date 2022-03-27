jest.mock("inquirer");
import {Setup} from "../../src/utils/setup";
import * as fs from "fs-extra";
import * as inquirer from "inquirer";

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


  it('should create a md file from questions', async () => {
    // @ts-ignore
    inquirer.prompt.mockResolvedValue(Promise.resolve({
      title: 'Test Title',
      categories: 'category 1, category 2',
      tags: 'tag 1, tag 2',
      date: new Date().toLocaleDateString(),
    }));

    await new Setup().new();

    const mdFile = `---
title: Test Title
url: test-title
date: ${new Date().toLocaleDateString('en-CA')}
categories: category 1, category 2
tags: tag 1, tag 2
---`

    console.log(mdFile);
    expect(fs.readFileSync('./test-title.md', 'utf-8')).toBe(mdFile);
    fs.removeSync('./test-title.md');
  });

  it('should throw an error when something fail creating a file', async () => {
    // @ts-ignore
    inquirer.prompt.mockResolvedValue(Promise.resolve({
      categories: 'category 1, category 2',
      tags: 'tag 1, tag 2',
      date: new Date().toLocaleDateString('en-CA'),
    }));

    try{
      await new Setup().new();
    } catch (error: any){
      expect(error.message).toBe('Error creating new file');
    }
  })

})
