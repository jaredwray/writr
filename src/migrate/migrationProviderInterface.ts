export interface MigrationProviderInterface {
    migrate(src: string, dest: string): Promise<boolean>;
}
