# Use the official Node.js image as the base image
FROM node:14

# Create and set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the container
COPY package*.json ./

# Install the project dependencies
RUN npm install

# Copy the rest of the application code to the container
COPY . .

# Expose the port your app is running on
EXPOSE 5001

# Command to run your application
CMD ["node", "your-app-file.js"]
