
FROM node:24-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN DATABASE_URL="postgresql://ci:ci@localhost:5432/ci?schema=public" npx prisma generate

RUN npm run build

CMD ["npm", "run", "start:prod"]
