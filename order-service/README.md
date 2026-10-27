# distributed-backend-system
-  nest new [service-name] --skip-git --package-manager npm

# generate fast resource 
- nest g module orders/order --flat; nest g controller orders/order --flat --no-spec; nest g service orders/order --flat --no-spec


# installed library
-  npm install --save-dev prisma@7
-  npm install @prisma/client@7
- npm install amqplib 
- npm install --save-dev @types/amqplib   
- npm i @nestjs/config
- npm install class-validator class-transformer
- npm install @prisma/adapter-pg pg
- npx prisma init --no-skills


# other libraries
- npm install axios