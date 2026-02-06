FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Clone the replays-api repository
RUN apt-get update && apt-get install -y git curl && \
    git clone https://github.com/aoe4world/replays-api.git .

# Build the project
RUN dotnet restore
RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:5069
EXPOSE 5069

ENTRYPOINT ["dotnet"]
CMD ["Aoe4WorldReplaysApi.dll"]
