export default async function handler(req, res) {
  const response = await fetch("https://api.football-data.org/v4/competitions/WC/matches", {
    headers: { "X-Auth-Token": "08ca204a70bc4fdabf71c59366e3c7d1" }
  });
  const data = await response.json();
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(data);
}
