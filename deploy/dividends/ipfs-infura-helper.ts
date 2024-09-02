export default class IpfsInfuraHelper {
  ipfsAuthorization: string;
  address: string;
  constructor(projectId: string, projectSecret: string) {
    this.ipfsAuthorization =
      "Basic " +
      Buffer.from(projectId + ":" + projectSecret).toString("base64");
    this.address = "https://ipfs.infura.io:5001/api/v0";
  }

  async add(data: any) {
    const requestOptions = {
      method: "POST",
      headers: { authorization: this.ipfsAuthorization },
      body: data,
    };
    const response = await fetch(`${this.address}/add`, requestOptions);

    return response.json();
  }
}
