FROM ubuntu:18.04
LABEL maintainer="Postman Labs <help@postman.com>"

ARG NODE_VERSION=10
ARG NEWMAN_VERSION

# Bail out early if NEWMAN_VERSION is not provided
RUN if ! echo "v$NEWMAN_VERSION" | grep -qE '^v[0-9]+\.[0-9]+\.[0-9]+$'; then \
        printf '\e[0;31m%s\e[0m\n' \
               "A valid semver is required in --build-arg NEWMAN_VERSION='$NEWMAN_VERSION'"; \
        exit 1; \
    fi

# Install node
ADD https://deb.nodesource.com/setup_$NODE_VERSION.x /opt/install_node.sh

RUN apt-get update -y && \
    apt-get upgrade -y && \
    apt-get install -y gnupg && \
    bash /opt/install_node.sh && \
    apt-get install -y nodejs && \
    npm install -g newman@${NEWMAN_VERSION} && \
    rm /opt/install_node.sh && \
    apt-get purge -y gnupg;

# Set environment variables
ENV LC_ALL="en_US.UTF-8" LANG="en_US.UTF-8" LANGUAGE="en_US.UTF-8"

# Set workdir to /etc/newman
# When running the image, mount the directory containing your collection to this location
#
# docker run -v <path to collections directory>:/etc/newman ...
#
# In case you mount your collections directory to a different location, you will need to give absolute paths to any
# collection, environment files you want to pass to newman, and if you want newman reports to be saved to your disk.
# Or you can change the workdir by using the -w or --workdir flag
WORKDIR /etc/newman

# Set newman as the default container command
# Now you can run the container via
#
# docker run -v /home/collections:/etc/newman -t postman/newman_ubuntu run YourCollection.json.postman_collection \
#                                                                          -e YourEnvironment.postman_environment \
#                                                                          -H newman_report.html
ENTRYPOINT ["newman"]
