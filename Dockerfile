FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.31-alpine AS runtime

# Where /api/ is proxied to (the gateway's admin API); override per deployment,
# e.g. -e KAWA_API_UPSTREAM=http://gateway:8080.
ENV KAWA_API_UPSTREAM=http://host.docker.internal:8080
COPY docker/templates /etc/nginx/templates
COPY --from=build /app/dist /usr/share/nginx/html/admin

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
