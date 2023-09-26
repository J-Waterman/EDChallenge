FROM public.ecr.aws/docker/library/node:18

WORKDIR /app

COPY ./src /app/src
COPY package*.json /app/
COPY tsconfig.json /app/

RUN npm install

# Compile TypeScript to JavaScript
RUN npx tsc

EXPOSE 8080

CMD ["node", "dist/index.js"]