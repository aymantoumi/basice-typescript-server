# The official image of node js from docker hub
FROM node:25-alpine3.21

# The working directory in the container
WORKDIR /app

# Copy package.json files first
COPY package*.json ./

# Copy Drizzle schema and configuration
COPY drizzle ./drizzle

# Install all dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Generate Drizzle schema and push to database
RUN npx drizzle-kit generate
RUN npx drizzle-kit push

# Expose your application port
EXPOSE 3400

# The final command to run in development mode
CMD ["npm", "run", "dev"]