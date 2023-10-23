export class WritrConsole {
    log(message: string): void {
        console.log(message);
    }

    error(message: string): void {
        console.error(message);
    }

    warn(message: string): void {
        console.warn(message);
    }

    printHelp(): void {
        console.log(`   Usage: writr [options] [command] [arguments]`);
        console.log();
        console.log(`   Options:`);
        console.log(`     -h, --help     output usage information`);
        console.log(`     -v, --version  output the version number`);
        console.log();
        console.log(`   Commands:`);
        console.log(`     init           Initialize a new project`);
        console.log(`     build          Build the project`);
        console.log(`     serve          Serve the project`);
        console.log();
        console.log(`   Arguments:`);
        console.log(`     -p, --port         Set the port number used with serve`);
        console.log(`     -s, --silent       Disable logging`);
        console.log(`     -o, --output       Set the output directory`);
        console.log(`     -p, --path         Set the path where files are located`);
        console.log(`     -t, --template     Set the path where files are located`);
    }
}
