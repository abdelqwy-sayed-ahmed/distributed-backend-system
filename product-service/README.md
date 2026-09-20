
# generate prisma client 
- npm run prisma:client

# Format prisma schema
- npm run prisma:format

# generate prisma migration 
- npm run prisma:migration:generate -- [migration-name] 

# run prisma migration
- npm run prisma:migration:run

### Note

- Prisma 7 now requires a driver adapter (PrismaPg adapter) when connecting to PostgreSQL.

# install
npm install @prisma/adapter-pg pg

# updated code (add this code to the prismaservice constructor)

 constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });

    super({ adapter });
  }
# change the output dir for prisma client

generator client {
  provider = "prisma-client"
  output   = "../src/prisma-client"
}

