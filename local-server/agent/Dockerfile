FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json ./
COPY src ./src

USER node
CMD ["npm", "start"]
